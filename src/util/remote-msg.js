const SockJS = require('./sockjs.min.js');
const Stomp = require('./stomp.min.js').Stomp;

const refactoring_engine_endpoint = "ws://localhost:8080/Q4BlocksWebService/websocketendpoint";

class RemoteMsg {
	constructor() {
		this.socket = new SockJS('http://localhost:8080/gs-guide-websocket');
		this.stompClient = Stomp.over(this.socket);
		this.stompClient.debug = null;
		this.stompClient.connect({}, function (frame) {
        	console.log('Connected to the refactoring endpoint');
     		
        	this.subscribe('/user/queue/hello', function (greeting) {
        		console.log(JSON.parse(greeting.body).content);
        	});
    	});		
	}

	sendEvent(e) {
		this.stompClient.send("/app/hello", {}, JSON.stringify({'name': 'Karn'}));
	}

}

module.exports = RemoteMsg;