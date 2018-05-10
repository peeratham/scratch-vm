const SockJS = require('./sockjs.min.js');
const Stomp = require('./stomp.js').Stomp;

class RemoteMsg {
	constructor(vm) {
		this.vm = vm;
		// this.socket = new SockJS('http://localhost:8080/service-endpoint');
		// this.stompClient = Stomp.over(this.socket);
		const base_deployment_server_url = '128.173.237.93:8888';
		const base_local_server_url = 'localhost:8888';
		this.stompClient = Stomp.client('ws://'+base_deployment_server_url+'/service-endpoint'); 		

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
		let request = {"refactoring": event['type'], 
    				"targetBlockExpId": event['blockId'],
    				"targetBlockIDs": event['targetBlockIDs']
    				};
		let body = {"request":request, "targets":event["targets"]};
   
		message['type'] = "invocation";
		message['body'] = JSON.stringify(body);

	    console.log(JSON.stringify(message));
		this.stompClient.send("/app/request", {}, JSON.stringify(message));
	}

}

module.exports = RemoteMsg;
