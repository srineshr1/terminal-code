// Test file for syntax highlighting
'use strict';

const path = require('path');
const fs = require('fs').promises;

// This is a comment
function testFunction() {
  const number = 42;
  const string = 'hello world';
  const boolean = true;
  const nullValue = null;
  
  return {
    number,
    string,
    boolean,
    nullValue
  };
}

class TestClass {
  constructor(name) {
    this.name = name;
  }
  
  async getData() {
    const data = await fs.readFile('test.txt', 'utf8');
    return data;
  }
}

const instance = new TestClass('test');
console.log(instance.name);
