var express = require('express')
var bodyParser = require('body-parser')
var mongoose = require('mongoose')
var passport = require('passport')
var Strategy = require('passport-http-bearer').Strategy
var jwt = require('jsonwebtoken')
var bcrypt = require('bcryptjs')
var formidable = require('formidable')
var path = require('path')
var fs = require('fs')
//use global promise library
mongoose.Promise = global.Promise;
var Task = require('./Task')
var User = require('./User')
var cors = require('cors');
var path = require('path')

require("dotenv").config({silent: true});
var DATABASE_URI = process.env.DATABASE_URI;
var TOKENSECRET = process.env.SECRET;

var jsonParser = bodyParser.json()

var app = express()
app.use(cors());

app.use(express.static('dist'));

//create passport strategy to check for valid json web tokens.
passport.use(new Strategy(
  function(token, done) {
    if(token) {
      jwt.verify(token, TOKENSECRET, function(err, decoded) {
        if(err) {
          return done(err)
        }
        return done(null, decoded, {scope: 'all'})
      })
    } else {
      return done(null, false)
    }
  }
))
app.use(passport.initialize())

//register new user
//requires name, email and password in request body
//returns status 201 with mongo id, name, courses (enrolled in) and json web token valide for 24 hours
//returns status 400 for email already in use, status 500 for server or database error
app.post('/users', jsonParser, function(req,res) {
  var name = req.body.name
  var email = req.body.email
  var password = req.body.password
  User.findOne({email: email}).exec()
  .then(function(user) {
    if(user != null) {
      throw "emailInUse";
    }
    return bcrypt.genSalt(10, function(err, salt) {
      if(err) {
        throw err;
      }
      return bcrypt.hash(password, salt, function(err, hash) {
        if(err) {
          throw err;
        }
        var user = new User()
        user.name = name;
        user.email = email;
        user.password = hash;
        console.log("new user: ", user);
        user.save()
        .then(function(user) {
          console.log("saved user: ", user);
          var token = jwt.sign({
            _id: user._id,
            name: user.name,
            email: user.email,
          }, TOKENSECRET, {
            expiresIn: "24h"
          });
          return res.status(201).json({
            _id: user._id,
            name: user.name,
            token: token
          });
        })
      });
    });
  })
  .catch(function(err) {
    console.log("error: ", err);
    if(err === "emailInUse") {
      return res.status(400).json({message: "email already associated with an account"});
    }
    return res.status(500).json({message: 'Internal server error'});
  })
})

//logs in user, generates json web token valid for 24 hours
//requires user email and password in request body
//returns status 200 with user mongo id, name, email, enrolled courses, ids of passed quizzes and json web token
//returns status 400 for invalide password or token
app.post('/login', jsonParser, function(req, res) {
  var password = req.body.password
  User.findOne({email: req.body.email}).exec()
  .then(function(user) {
    if(!user) return res.status(400)
    user.validatePassword(password, function(err, isValid) {
      if(err) {
        return res.status(400).json({message: 'Invalid token'})
      }
      if(!isValid) {
        return res.status(400).json({message: 'Incorrect password'})
      }
      var token = jwt.sign({
        _id: user._id,
        name: user.name,
        email: user.email,
      }, TOKENSECRET, {
        expiresIn: "24h"
      })
      user = user.toObject();
      return res.status(200).json({
        _id: user._id,
        name: user.name,
        token: token
      });
    })
  })
  .catch(function(err) {
    console.log("error: ", err);
    return res.status(500).json({message: 'Internal server error'})
  });
})

app.post('/profileImage',
  passport.authenticate('bearer', {session:false}),
  function(req, res) {
    var form = new formidable.IncomingForm();
    form.multiples = true;
    form.uploadDir = path.join(__dirname);
    form.parse(req, function(err, fields, files) {
      console.log("parsed files: ", files.file.path);
      res.status(1).json(files.file.path);
    });
  }
)

//create new task
app.post("/task", passport.authenticate('bearer', {session: false}), jsonParser, function(req, res) {
  if(!req.body.name ||
     !req.body.end ||
     !req.body.description ||
     !req.body.createdBy) {
       return res.status(400).json('Bad Request');
   }
  else {
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
  }
});

//get all tasks
app.get("/task/:createdOrEnd/:date/:whose", passport.authenticate('bearer', {session: false}), function(req, res) {
  // console.log("params: ", req.params, "user :", req.user)
  if(req.params.whose === 'mine') {
    if(req.params.createdOrEnd === "all") {
      Task.find({createdBy: req.user._id}).exec()
      .then(function(tasks) {
        return res.status(200).json(tasks);
      })
      .catch(function(err) {
        console.log("error: ", err);
        return res.status(500).json('Internal Server Error');
      });
    }
    else if(req.params.createdOrEnd === "created") {
      Task.find({
        createdBy: req.user._id,
        created: {$gt: +req.params.date}
      }).exec()
      .then(function(tasks) {
        return res.status(200).json(tasks);
      })
      .catch(function(err) {
        console.log("error: ", err);
        return res.status(500).json('Internal Server Error');
      });
    }
    else if(req.params.createdOrEnd === "end"){
      Task.find({
        createdBy: req.user._id,
        end: {$lt: +req.params.date}
      }).exec()
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
  } else {
    //return everyone's tasks
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
      Task.find({
        created: {$gt: +req.params.date}
      }).exec()
      .then(function(tasks) {
        return res.status(200).json(tasks);
      })
      .catch(function(err) {
        console.log("error: ", err);
        return res.status(500).json('Internal Server Error');
      });
    }
    else if(req.params.createdOrEnd === "end"){
      Task.find({
        end: {$lt: +req.params.date}
      }).exec()
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

app.get("*", function(req, res) {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});


mongoose.Promise = global.Promise;
mongoose.connect(process.env.DATABASE_URI || 'mongodb://<database name>')
.then(function() {
  var PORT = process.env.PORT || 8080
  app.listen(PORT)
  console.log("Server is listening on ", PORT)
}).catch(function(error) {
  console.log("Server error: ", error)
})
