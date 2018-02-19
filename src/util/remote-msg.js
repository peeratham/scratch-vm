const SockJS = require('./sockjs.min.js');
const Stomp = require('./stomp.min.js').Stomp;

class RemoteMsg {
	constructor() {
		this.socket = new SockJS('http://localhost:8080/service-endpoint');
		this.stompClient = Stomp.over(this.socket);
		this.stompClient.debug = null;
		this.stompClient.connect({}, function (frame) {
        	console.log('Connected to the refactoring endpoint');
     		
        	this.subscribe('/user/queue/request', function (greeting) {
        		console.log(JSON.parse(greeting.body).content);
        	});
    	});		
	}

	sendEvent(event) {
		let message = {};
		message['type'] = 'invocation';
		message['body'] = 'body data'
		message['invocation'] = {
        	'blocks': event['blocks']["xml"],
        	'blockId' : event['blockId'],
        	'refactoring' : event['type']
        };

		this.stompClient.send("/app/request", {}, JSON.stringify(message));
	}

}

module.exports = RemoteMsg;