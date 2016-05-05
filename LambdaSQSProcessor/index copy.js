console.log('Loading function');

// Require the demo configuration. This contains settings for this demo, including
// the AWS credentials and target queue settings.
var config = require( "./config.json" );

// Require libraries.
var aws = require( "aws-sdk" );
var Q = require( "q" );
var chalk = require( "chalk" );

var sqs = new aws.SQS({
    region: config.REGION,
    params: {
        QueueUrl: config.SOURCE_SQS_QUEUE
    }
});

//not using event based lamba, leaving this empty
exports.handler = function(event, context) {
}  

var receiveMessage = Q.nbind( sqs.receiveMessage, sqs );
var deleteMessage = Q.nbind( sqs.deleteMessage, sqs );
var sendMessage = Q.nbind( sqs.SendMessage, sqs );

//Long Pole the queue
(function pollQueueForMessages() {

    console.log( chalk.yellow( "Starting long-poll operation." ) );

    receiveMessage({
        WaitTimeSeconds: 0,
        VisibilityTimeout: 10,
        MaxNumberOfMessages: 1
    })
    .then(
        function handleMessageResolve( data ) {

            // If there are no message, throw an error so that we can bypass the
            // subsequent resolution handler that is expecting to have a message
            // delete confirmation.
            if ( ! data.Messages ) {
                throw(
                    workflowError(
                        "EmptyQueue",
                        new Error( "There are no messages to process." )
                    )
                );
            }

            var msgId = data.Messages[ 0 ].MessageId;
            var msgBody = data.Messages[ 0 ].Body;
            var msg = msgId + ' ' + msgBody;
            
            console.log( chalk.green( "Processing Message:", msg ));

            var queues = config.TARGETS;
            var length = queues.length;  
            var simulateFail = false; 
            var delay = 0;
            for (var i = 0; i < length; i++) {
                if(i == 1){
                    //simulateFail = true;
                    delay = 500;
                }
                //SendMessage(queues[i], msgBody, simulateFail);
                SendMessageWrapper(queues[i], msgBody, simulateFail, delay);
            }

            //console.log( chalk.green( "Deleting:", msgId ) );

            return(
                deleteMessage({
                    ReceiptHandle: data.Messages[ 0 ].ReceiptHandle
                })
            );

        }
    )
    .then(
        function handleDeleteResolve( data ) {
            var msg = "Message Deleted: " + Date.now();
            console.log( chalk.green( msg ) );
        }
    )
    // Catch any error (or rejection) that took place during processing.
    .catch(
        function handleError( error ) {
            switch ( error.type ) {
                case "EmptyQueue":
                    console.log( chalk.cyan( "Expected Error:", error.message ) );
                break;
                case "SimulateFailure":
                    console.log( chalk.cyan( "Expected Error:", error.message ) );
                break;
                default:
                    console.log( chalk.red( "Unexpected Error:", error.message ) );
                break;
            }
        }
    )
    .finally( pollQueueForMessages );

})();

function SendMessageWrapper (url, body, simulateFailure, delay){       
    setTimeout(function () {
        SendMessage (url, body, simulateFailure);
    }, delay)
}

function SendMessage (url, body, simulateFailure){
    
    if(simulateFailure){
        throw(
            workflowError(
                "SimulateFailure",
                new Error( "Simulated failure." )
            )
        ); 
    }
    
    var sqsSend = new aws.SQS({
        region: config.REGION,
    });

    var msg = body;
    var sqsParams = {
        MessageBody: body,
        QueueUrl: url
    };

    sqs.sendMessage(sqsParams, function(err, data) {
        var msg = "Message Sent: " + Date.now() + " " + data.ResponseMetadata;
        console.log( msg );
    }); 

}

function workflowError( type, error ) {
    error.type = type;
    return( error );
}

