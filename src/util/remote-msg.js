const SockJS = require('./sockjs.min.js');
const Stomp = require('./stomp.min.js').Stomp;

class RemoteMsg {
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
		console.log(JSON.parse(serverMsg.body).type);
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
