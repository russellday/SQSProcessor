console.log('Loading function');

// Require the demo configuration. This contains settings for this demo, including
// the AWS credentials and target queue settings.
var config = require( "./config.json" );

// Require libraries.
var aws = require( "aws-sdk" );
var Q = require( "q" );
var chalk = require( "chalk" );

// Create an instance of our SQS Client.
var sqs = new aws.SQS({
    region: config.REGION,
    accessKeyId: config.ACCESS_KEY_ID,
    secretAccessKey: config.SECRET_KEY,
    params: {
        QueueUrl: config.SOURCE_SQS_QUEUE
    }
});

exports.handler = function(event, context) {
}  

var receiveMessage = Q.nbind( sqs.receiveMessage, sqs );
var deleteMessage = Q.nbind( sqs.deleteMessage, sqs );

//Long Pole the queue
(function pollQueueForMessages() {

    console.log( chalk.yellow( "Starting long-poll operation." ) );

    receiveMessage({
        WaitTimeSeconds: 20, // Enable long-polling
        VisibilityTimeout: 10
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

            console.log( chalk.green( "Processing Message:", data.Messages[ 0 ].Body ) );

            var queues = config.TARGETS;
            var length = queues.length;   
                for (var i = 0; i < length; i++) {
                SendMessage(queues[i], data.Messages[ 0 ].Body);
            }

            console.log( chalk.green( "Deleting:", data.Messages[ 0 ].MessageId ) );

            return(
                deleteMessage({
                    ReceiptHandle: data.Messages[ 0 ].ReceiptHandle
                })
            );

        }
    )
    .then(
        function handleDeleteResolve( data ) {
            console.log( chalk.green( "Message Deleted!" ) );
        }
    )

    // Catch any error (or rejection) that took place during processing.
    .catch(
        function handleError( error ) {
            switch ( error.type ) {
                case "EmptyQueue":
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

function SendMessage (url, body){
    console.log("SendMessage", url);
    
    var sqsSend = new aws.SQS({
        region: config.REGION,
        accessKeyId: config.AWS_ACCOUNT_ID,
        secretAccessKey: config.SECRET_KEY
    });

    var msg = body;
    var sqsParams = {
        MessageBody: body,
        QueueUrl: url
    };

    sqs.sendMessage(sqsParams, function(err, data) {
    if (err) {
        console.log('ERR', err);
    }
    console.log(data);
    }); 
    
}

function workflowError( type, error ) {
    error.type = type;
    return( error );

}

