import _ from 'lodash';
import './styles.css';
import printMe from './print.js';

console.log('index.js loaded xtsst');

function component() {
  const element = document.createElement('div');
  const btn = document.createElement('button');

  // Lodash, currently included via a script, is required for this line to work
  element.innerHTML = _.join(['Hello', 'webpack WOW 3 4 5 6 7z'], ' ');
  element.classList.add('hello');


  btn.innerHTML = 'Click me and check the console b!';
  btn.onclick = printMe;

  element.appendChild(btn);

  return element;
}

document.body.appendChild(component());