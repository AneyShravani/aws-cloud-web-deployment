const crypto = require('crypto');

const generatePassword = (length = 12) => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + special;

  const randomChars = [];

  randomChars.push(uppercase[crypto.randomInt(0, uppercase.length)]);
  randomChars.push(lowercase[crypto.randomInt(0, lowercase.length)]);
  randomChars.push(numbers[crypto.randomInt(0, numbers.length)]);
  randomChars.push(special[crypto.randomInt(0, special.length)]);

  while (randomChars.length < length) {
    randomChars.push(allChars[crypto.randomInt(0, allChars.length)]);
  }

  for (let index = randomChars.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(0, index + 1);
    [randomChars[index], randomChars[swapIndex]] = [randomChars[swapIndex], randomChars[index]];
  }

  return randomChars.join('');
};

module.exports = {
  generatePassword,
};
