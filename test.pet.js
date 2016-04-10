var step = require('./pet').step;

step('I say $text', function(text) {
	console.log('Say', text);
});

step('I say $text and I also say $somethingElse', function(text, somethingElse) {
	console.log('Say', text, 'and', somethingElse);
});

step('I wait $ms milliseconds', function(ms) {
	// TODO won't work yet!
	return new Promise(function(resolve) {
		console.log('wait start');
		setTimeout(function() {
			console.log('wait end');
			resolve();
		}, ms);
	});
});