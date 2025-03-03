const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const flash = require('express-flash');
const session = require('express-session');


const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(flash());
app.use(session({ secret: 'your_secret_key', resave: false, saveUninitialized: true }));


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const dataFile = path.join(__dirname, 'data.json');

// fetch data from json file and save to file once changes are made to the timetable 
function loadData() {
  if (fs.existsSync(dataFile)) {
    const data = fs.readFileSync(dataFile);
    return JSON.parse(data);
  } else {
    return { timetable: [], subjects: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function validateTimetable(timetable) {
  const subjectHours = {
    languages: 10,
    sciences: 10,
    arts: 5,
    sports: 5,
  };

  const hoursCount = timetable.reduce((acc, day) => {
    day.schedule.forEach(subject => {
      if (subject) {
        acc[subject] = (acc[subject] || 0) + 1;
      }
    });
    return acc;
  }, {});

  return Object.keys(subjectHours).every(subject => hoursCount[subject] <= subjectHours[subject]);
}

function generateTimetable() {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const timeSlots = ['8-9am', '9-10am', '10-11am', '11am-12pm', '1-2pm', '2-3pm'];

    // constraints 
    const subjectHours = {
        languages: 10,
        sciences: 10,
        arts: 5,
        sports: 5,
    };

    const subjects = Object.keys(subjectHours);
    const timetable = days.map(day => ({
        day,
        schedule: Array(timeSlots.length).fill(null)
    }));

    // helper function
    function distributeSubjects() {
        const remainingHours = { ...subjectHours };

        // loop through each day and slot
        timetable.forEach(day => {
            for (let i = 0; i < timeSlots.length; i++) {
                const availableSubjects = subjects.filter(subject => remainingHours[subject] > 0);
                if (availableSubjects.length === 0) continue;
                const subject = availableSubjects[Math.floor(Math.random() * availableSubjects.length)];
                day.schedule[i] = subject;
                remainingHours[subject]--;
            }
        });
    }

    distributeSubjects();

    // if the timetable violates constraints, retry
    if (!validateTimetable(timetable)) {
        return generateTimetable(); // and then recursively recall function until constraints are met
    }

    saveData({ timetable, subjects: subjectHours });
    return timetable;
}


// routes
app.get('/', (req, res) => {
  const data = loadData();
  const message = req.flash('message')[0] || {}; 
  res.render('index', { timetable: data.timetable, subjects: Object.keys(data.subjects || {}), message });
});

app.post('/generate', (req, res) => {
  const timetable = generateTimetable();
  if (validateTimetable(timetable)) {
    req.flash('message', { success: true, text: 'Timetable generated successfully.' });
  } else {
    req.flash('message', { success: false, text: 'Timetable violates constraints. Please adjust and try again.' });
  }
  console.log(req.flash('message')); 
  res.redirect('/');
});


app.post('/edit-slot', (req, res) => {
  const { dayIndex, slot, subject } = req.body;
  const data = loadData();
  const timetable = data.timetable || generateTimetable();

  if (dayIndex >= 0 && dayIndex < timetable.length) {
    const daySchedule = timetable[dayIndex].schedule;
    if (slot >= 0 && slot < daySchedule.length) {
      daySchedule[slot] = subject;
      if (validateTimetable(timetable)) {
        saveData({ timetable, subjects: data.subjects });
        res.json({ success: true, message: 'Slot updated successfully.' });
      } else {
        res.json({ success: false, message: 'Timetable violates constraints. Please adjust and try again.' });
      }
      return;
    }
  }

  res.json({ success: false, message: 'Invalid slot or day index.' });
});

app.listen(3016, () => {
  console.log('Server running on http://localhost:3016');
});
