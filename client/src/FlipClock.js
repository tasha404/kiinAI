import React from "react";
import "./FlipClock.css";

const FlipUnit = ({ value, label }) => {
  const formatted = value < 10 ? `0${value}` : value;

  return (
    <div className="flip-unit">
      <div className="flip-card">
        <div className="number">{formatted}</div>
      </div>
      <span className="label">{label}</span>
    </div>
  );
};

const FlipClock = ({ time }) => {
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;

  return (
    <div className="flip-clock">
      <FlipUnit value={minutes} label="MIN" />
      <FlipUnit value={seconds} label="SEC" />
    </div>
  );
};

export default FlipClock;