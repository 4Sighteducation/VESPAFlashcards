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
    school = "",
    role = ""
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
          <div className="user-primary-info">
            {name && <div className="user-name">{name}</div>}
            {email && <div className="user-email">{email}</div>}
            {role && <div className="user-role">{role}</div>}
          </div>
          
          {/* Show school info if available */}
          {school && (
            <div className="user-school">
              <span className="label">School:</span> {school}
            </div>
          )}
          
          {/* Highlight student-specific information */}
          <div className="user-additional-info">
            {yearGroup && (
              <div className="info-item user-year-group">
                <span className="label">Year:</span> {yearGroup}
              </div>
            )}
            {tutorGroup && (
              <div className="info-item user-tutor-group">
                <span className="label">Group:</span> {tutorGroup}
              </div>
            )}
            {tutor && (
              <div className="info-item user-tutor">
                <span className="label">Tutor:</span> {tutor}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile; 