var mongoose = require('mongoose'), Schema = mongoose.Schema
var bcrypt = require('bcryptjs')

var UserSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  profilePicSet: {
    type: Boolean
  }
})

UserSchema.methods.validatePassword = function(password, callback) {
  bcrypt.compare(password, this.password, function(err, isValid) {
    if(err) {
      callback(err)
      return
    }
    callback(null, isValid)
  })
}

var User = mongoose.model('UserElearn', UserSchema)
module.exports = User
