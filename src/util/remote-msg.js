const SockJS = require('./sockjs.min.js');
const Stomp = require('./stomp.min.js').Stomp;

class RemoteMsg {
	constructor(vm) {
		this.vm = vm;
		this.socket = new SockJS('http://localhost:8080/service-endpoint');
		this.stompClient = Stomp.over(this.socket);
		this.stompClient.debug = null;
  		
  		this.stompClient.connect({}, function (frame) {
  			// connection established
	  		console.log('Connected to the refactoring endpoint');
  			
  			// subscribe upon connection
  			this.stompClient.subscribe('/user/queue/request', function (serverMsg) {
  				this.receiveMessage(serverMsg);
  			}.bind(this));

  		}.bind(this));
	}

	receiveMessage(serverMsg) {
		const msg = JSON.parse(serverMsg.body);
		this.vm.emit('BLOCK_TRANSFORM', {type: msg.type, body: msg.body});
	}

	sendEvent(event) {
		let message = {};
        message['type'] = "invocation";
        let request = {"refactoring": event['type'], "targetBlockExpId": event['blockId']};
    	let body = {"request":request, "targets":event["targets"]};
        message['body'] = JSON.stringify(body);

        console.log(JSON.stringify(message));
		this.stompClient.send("/app/request", {}, JSON.stringify(message));
	}

}

module.exports = RemoteMsg;
