var step = require('./pet').step;

step('I say $text', function(text) {
	console.log('Say', text);
});

step('I say $text and I also say $somethingElse', function(text, somethingElse) {
	console.log('Say', text, 'and', somethingElse);
});
