var express = require('express')
var bodyParser = require('body-parser')
var mongoose = require('mongoose')
//use global promise library
mongoose.Promise = global.Promise;
var Task = require('./Task')
var cors = require('cors');

require("dotenv").config({silent: true});
var DATABASE_URI = process.env.DATABASE_URI

var jsonParser = bodyParser.json()

var app = express()
app.use(cors());

//create new task
app.post("/task", jsonParser, function(req, res) {
  var newTask = new Task();
  newTask.name = req.body.name;
  newTask.end = req.body.end;
  newTask.description = req.body.description;
  newTask.created = Date.now();
  newTask.createdBy = req.body.createdBy;
  newTask.save()
  .then(function(newTaskCreated) {
    return res.status(201).json(newTaskCreated);
  })
  .catch(function(err) {
    console.log("error: ", err);
    return res.status(500).json('Internal Server Error');
  });
});

//get all tasks
app.get("/task/:createdOrEnd/:date", function(req, res) {
  if(req.params.createdOrEnd === "all") {
    Task.find({}).exec()
    .then(function(tasks) {
      return res.status(200).json(tasks);
    })
    .catch(function(err) {
      console.log("error: ", err);
      return res.status(500).json('Internal Server Error');
    });
  }
  else if(req.params.createdOrEnd === "created") {
    Task.find({created: {$gt: req.params.date}}).exec()
    .then(function(tasks) {
      return res.status(200).json(tasks);
    })
    .catch(function(err) {
      console.log("error: ", err);
      return res.status(500).json('Internal Server Error');
    });
  }
  else if(req.params.createdOrEnd === "end"){
    Task.find({end: {$lt: req.params.date}}).exec()
    .then(function(tasks) {
      return res.status(200).json(tasks);
    })
    .catch(function(err) {
      console.log("error: ", err);
      return res.status(500).json('Internal Server Error');
    });
  }
  else {
    return res.status(400).json('Invalid created or end specification');
  }
});

//update task
app.put("/task", jsonParser, function(req, res) {
  Task.findOneAndUpdate({_id: req.body._id},
  {$set: {
    name: req.body.name,
    end: req.body.end,
    description: req.body.description,
    createdBy: req.body.createdBy
    }
  },
  {new: true})
  .exec()
  .then(function(updatedTask) {
    return res.status(200).json(updatedTask);
  })
  .catch(function(err) {
    console.log("error: ", err);
    return res.status(500).json('Internal Server Error');
  });
});

//delete task
app.delete("/task/:taskID", function(req, res) {
  Task.remove({_id: req.params.taskID}).exec()
  .then(function() {
    return res.status(200).json('Task Deleted');
  })
  .catch(function(err) {
    console.log("error: ", err);
    return res.status(500).json('Internal Server Error');
  })
})



mongoose.Promise = global.Promise;
mongoose.connect(process.env.DATABASE_URI || 'mongodb://<database name>')
.then(function() {
  var PORT = process.env.PORT || 8080
  app.listen(PORT)
  console.log("Server is listening on ", PORT)
}).catch(function(error) {
  console.log("Server error: ", error)
})
