// utils.js
// Helper functions used by all other files

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Random delay between min and max milliseconds — feels human
const randomDelay = (min = 3000, max = 7000) => {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return sleep(ms);
};

// Get first name from full name
const getFirstName = (fullName) => {
  return (fullName || "").trim().split(" ")[0];
};

module.exports = { sleep, randomDelay, getFirstName };