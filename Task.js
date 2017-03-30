var mongoose = require('mongoose'), Schema = mongoose.Schema;

var taskSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  end: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  created: {
    type: Number,
    required: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    // type: String,
    ref: 'UserElearn'
  }
})

var Task = mongoose.model('Task', taskSchema)
module.exports = Task
