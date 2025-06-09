const UserModel = require("../Models/user.model");
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Sendmail = require("../utlis/sendmail");
const CreateOtpAndToken = require("../utlis/otp");
const OtpModel = require("../Models/otp.model");
const path = require("path");
const ejs = require("ejs");
require('dotenv').config();

const usercontroller = {

checkemail: async (req, res) => {
  const { email } = req.body;

  const user = await UserModel.findOne({ email });
  if (user && user.isVerified) {
    return res.json({ exists: true });
  }

  const { otp, token, expiresInSeconds } = CreateOtpAndToken({ email }, 600);
  const expiryDate = new Date(Date.now() + expiresInSeconds * 1000);

  try {
    await OtpModel.findOneAndUpdate(
      { email },
      { otp, otpExpires: expiryDate },
      { upsert: true, new: true }
    );

    // Render EJS email template
    const templatePath = path.join(__dirname + "/../views/email.ejs");
    const htmlContent = await ejs.renderFile(templatePath, {
      otp,
      firstName: user?.firstName || "User"
    });

    // Send email
    await Sendmail(email, htmlContent, "Your OTP Code");

    res.status(200).json({ exists: false, message: "OTP sent to email", token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
}
,
validateotp: async (req, res) => {
  const { email, otp, token } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.PRIVATE_KEY);
    const { userData, otp: tokenOtp } = decoded;

    if (userData.email !== email) {
      return res.status(400).json({ message: 'Email mismatch' });
    }

    if (tokenOtp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    const otpRecord = await OtpModel.findOne({ email });
    if (!otpRecord || otpRecord.otp !== otp || otpRecord.otpExpires < new Date()) {
      return res.status(400).json({ message: 'OTP expired or invalid' });
    }

    res.json({ message: 'OTP verified successfully' });
  } catch (err) {
    return res.status(400).json({ message: 'Invalid or expired token' });
  }
},
signup: async (req, res) => {
  const {
    email,
    firstName,
    surname,
    password,
    otp,
    shoppingPreference,
    dateOfBirth,
    location,
  } = req.body;

  if (req.body.role) {
    return res.status(400).json({
      message: "You do not have permission to assign roles.",
    });
  }

  if (
    !email ||
    !firstName ||
    !surname ||
    !password ||
    !otp ||
    !shoppingPreference ||
    !dateOfBirth
  ) {
    return res.status(400).json({
      message: "Please fill all the required fields.",
    });
  }

  try {
    const existingUser = await UserModel.findOne({ email });

    if (existingUser && existingUser.isVerified) {
      return res.status(400).json({ message: "User already signed up." });
    }

    const otpRecord = await OtpModel.findOne({ email });

    if (!otpRecord || otpRecord.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    if (otpRecord.otpExpires < new Date()) {
      return res.status(400).json({ message: "OTP expired." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let user;

    if (existingUser) {
      // Update unverified existing user
      user = existingUser;
      user.firstName = firstName;
      user.surname = surname;
      user.password = hashedPassword;
      user.shoppingPreference = shoppingPreference;
      user.dateOfBirth = dateOfBirth;
      user.location = location || user.location;
      user.isVerified = true;
    } else {
      // Create new user
      user = new UserModel({
        email,
        firstName,
        surname,
        password: hashedPassword,
        shoppingPreference,
        dateOfBirth,
        location,
        isVerified: true,
      });
    }

    await user.save();
    await OtpModel.deleteOne({ email }); // clean up OTP

    return res.status(200).json({ message: "Signup successful" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
},
login:async(req,res) => {
   try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await UserModel.findOne({ email });

    // Check if user exists and is verified
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: "User is not verified." });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password." });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.PRIVATE_KEY,
      { expiresIn: "1d" }
    );

    // Send token in cookie
    res
      .cookie("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", 
        sameSite: "Strict",
        maxAge: 604800000
      })
      .status(200)
      .json({ message: "Login successful", token });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
},
 getUserData: async (req, res) => {
    
    try {
      const user = await UserModel.findById(req.params.userId).select(
        "-password"
      );
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }
      res.status(200).json({ message: "User found", user });
    } catch (error) {
      res.status(400).json({ message: error?.message });
    }
  },
  updateUserInfo: async (req, res) => {
    if (req.params.userId !== req.user._id) {
      return res.status(400).json({ message: "You are not authorized" });
    }
    if (!req.file) {
      const updateprofile = await UserModel.findByIdAndUpdate(
        req.params.userId,
        { $set: { ...req.body } },{new:true}
      );
      if (!updateprofile) {
        return res
          .status(400)
          .json({ message: "Error while updating profile" });
      }
      res.status(200).json({ message: "Data updated successfully" ,user:updateprofile});
    }
    if (req.file) {
      const updateprofile = await UserModel.findByIdAndUpdate(
        req.params.userId,
        { $set: { ...req.body, profileImage: req.file.originalname } },{new:true}
      );
      if (!updateprofile) {
        return res
          .status(400)
          .json({ message: "Error while updating profile" });
      }
      res.status(200).json({ message: "Data updated successfully" ,user:updateprofile});
    }
  },
  resetPasswordByEmail: async (req, res) => {
    // for create token ,otp and sending reset-password-email
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Please provide email" });
    }
    try {
      const isExistUser = await UserModel.findOne({ email });

      if (!isExistUser) {
        return res.status(400).json({ message: "User not found" });
      }
      const { otp, token } = CreateOtpAndToken({ ...isExistUser }, "5m");

      const htmltemplate = await ejs.renderFile(
        __dirname + "/../views/resetpassword.ejs",
        {
          name: isExistUser.name,
          otp,
        }
      );

      await Sendmail(email, htmltemplate, "Reset Password");

      res
        .cookie("Password_Reset_Token", token)
        .status(200)
        .json({ message: "Reset password email sent successfully" });
    } catch (error) {
      res.status(400).json({ message: error?.message });
    }
  },
  verifyPasswordByOtp: async (req, res) => {
    // verfiy  token and otp and further reset the password
    if (!req.cookies.Password_Reset_Token) {
      return res
        .status(400)
        .json({ message: "Password reset token is missing" });
    }

    try {
      var decoded = jwt.verify(
        req.cookies.Password_Reset_Token,
        process.env.PRIVATE_KEY
      );
      if (!decoded) {
        return res.status(400).json({ message: "Token is Invalid" });
      }
      const { otp, userData } = decoded;

      if (otp !== req.body.otp) {
        return res.status(400).json({ message: "Otp is not valid" });
      }
      // hash the password
      try {
        const hashpassword = await bcrypt.hash(req.body.password, 10);
        // save the user in database
        const user = await UserModel.findByIdAndUpdate(userData._doc._id, {
          $set: { ...userData._doc, password: hashpassword },
        });

        console.log(user);
        // conformation message
        const htmltemplate = await ejs.renderFile(
          __dirname + "/../views/passwordresetsuccesfully.ejs",
          {
            name: userData.name,
          }
        );
        console.log(htmltemplate);
        await Sendmail(
          userData._doc.email,
          htmltemplate,
          "Password Reset Successfully"
        );

        res.status(200).json({ message: "Password reset successfully", user });
      } catch (error) {
        return res.status(400).json({ message: error?.message });
      }
    } catch (error) {
      return res.status(400).json({ message: error?.message });
    }
  },
  logout: async (req, res) => {
    try {
      res.clearCookie("auth_token")
      res.status(200).json({ message: "User logged out successfully" });
    } catch (error) {
      res.status(400).json({message:error.message})
    }
    
  },

  // admin side
  getAllUsers:async(req,res)=>{
    // logic for getting all users
    const limit = req.query.limit || 2;
   try {
    const users = await UserModel.find().select("-password").limit(limit)
    const totalUsers = await UserModel.countDocuments()
    if(!users){
      return res.status(400).json({message:"No user found"})
    }
    res.status(200).json({message:"All users",users,totalUsers})
    
   } catch (error) {
     res.status(400).json({message:error?.message})
    
   }
  },
  deleteUserByAdmin:async(req,res)=>{
    if(!req.params.userId){
      return res.status(400).json({message:"Please provide userId"})
    }
    try {
      const user = await UserModel.findByIdAndDelete(req.params.userId)
      if(!user){
        return res.status(400).json({message:"User not found"})
      }
      res.status(200).json({message:"User deleted successfully",user})
      
    } catch (error) {
      res.status(400).json({message:error?.message})
      
    }

  }



}

module.exports = usercontroller