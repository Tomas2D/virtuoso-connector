require('dotenv').config();

module.exports = {
  preset: 'ts-jest',
  moduleFileExtensions: ['json', 'ts', 'js'],
  testTimeout: 15000,
  testRegex: '.test.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
    },
  },
  collectCoverageFrom: ['**/*.ts', '!**/node_modules/**'],
  coveragePathIgnorePatterns: ['<rootDir>/node_modules', '<rootDir>/lib'],
};
