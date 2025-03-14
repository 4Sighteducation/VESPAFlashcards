import React from "react";
import "./UserProfile.css";

const UserProfile = ({ userInfo }) => {
  // Extract user data with defaults to handle undefined values
  const {
    name = "",
    email = "",
    tutorGroup = "",
    yearGroup = "",
    tutor = "",
    school = ""
  } = userInfo || {};

  // Only render if we have at least a name or email
  if (!name && !email) {
    return null;
  }

  return (
    <div className="user-profile">
      <div className="user-profile-container">
        <div className="user-avatar">
          {name ? name.charAt(0).toUpperCase() : email.charAt(0).toUpperCase()}
        </div>
        <div className="user-details">
          {name && <div className="user-name">{name}</div>}
          {email && <div className="user-email">{email}</div>}
          <div className="user-school-info">
            {school && <span className="user-school">School: {school}</span>}
            {yearGroup && <span className="user-year-group">Year: {yearGroup}</span>}
            {tutorGroup && <span className="user-tutor-group">Tutor Group: {tutorGroup}</span>}
            {tutor && <span className="user-tutor">Tutor: {tutor}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile; 