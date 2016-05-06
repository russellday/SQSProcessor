// Require the demo configuration. This contains settings for this demo, including
// the AWS credentials and target queue settings.
var config = require( "./config.json" );
var aws = require( "aws-sdk" );
var Q = require( "q" );
//var chalk = require( "chalk" );

var sqs = new aws.SQS({
    region: config.REGION,
    params: {
        QueueUrl: config.SOURCE_SQS_QUEUE
    }
});

var sqsTarget1 = new aws.SQS({
    region: config.REGION,
    params: {
        QueueUrl: config.TARGET_SQS_QUEUE_1
    }
});

var sqsTarget2 = new aws.SQS({
    region: config.REGION,
    params: {
        QueueUrl: config.TARGET_SQS_QUEUE_2
    }
});

var parent_sourcemsgId = "";
var parent_sourcemsgBody = "";
var parent_receipthandle = "";
var parent_msgsProcessed = 0;
var parent_secondsleft = 300;

exports.handler = function(event, context) {
    //console.log('functionName =', context.functionName);
    //console.log('AWSrequestID =', context.awsRequestId);
    //console.log('logGroupName =', context.logGroupName);
    //console.log('logStreamName =', context.logStreamName); 

    (function pollQueueForMessages() {

       parent_secondsleft = Number(context.getRemainingTimeInMillis());     
       if(parent_secondsleft <= 2000){
           var msg = "Aborting due to timeout approaching. Function name: " + context.functionName + 
                " processed " + parent_msgsProcessed + " messages.";
            console.log(msg);  
            throw(
                workflowError(
                    "GracefulStop",
                    new Error( msg )
                )
            );
       }

        receiveMessage({
            WaitTimeSeconds: 0,
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

                var msgId = data.Messages[ 0 ].MessageId;
                var msgBody = data.Messages[ 0 ].Body;
                var msg = msgId + ' ' + msgBody;
                
                //console.log( "Processing Message:", msg );
                
                parent_sourcemsgId = msgId;
                parent_sourcemsgBody = msgBody;
                parent_receipthandle = data.Messages[ 0 ].ReceiptHandle;
                
                return(
                    sendMessageTarget1({
                        MessageBody: data.Messages[ 0 ].Body
                    })
                );
            }
        )
        .then(
            function handleSendTarget1Resolve( data ) {
                //console.log("handleSendTarget1_Resolve - data: ", data);
                //console.log( "Sending to Target Queue 1");
                return(
                    sendMessageTarget2({
                        MessageBody: parent_sourcemsgBody
                    })
                );
            }
        )    
        .then(
            function handleSendTarget2Resolve( data ) {
                //console.log("handleSendTarget2_Resolve - data: ", data);
                //console.log("debug", parent_sourcemsgId);
                //console.log( "Sending to Target Queue 2");
                return(
                    deleteMessage({
                        ReceiptHandle: parent_receipthandle
                    })
                );
            }
        )     
        .then(
            function handleDeleteResolve( data ) {
                parent_msgsProcessed++;
                var msg = "Message Deleted: " + parent_sourcemsgId + 
                    " Time Remaining: " + parent_secondsleft + 
                    " Body: " + parent_sourcemsgBody;
                console.log( msg );                
                //console.log( "Messages Processed: ", parent_msgsProcessed);
            }
        )
        .catch(
            function handleError( error ) {
                switch ( error.type ) {
                    case "EmptyQueue":
                        //skip logging this message
                        //console.log( "Expected Error:", error.message );
                    break;
                    case "GracefulStop":
                        console.log( "Expected Error:", error.message );
                    break;
                    case "SimulateFailure":
                        console.log( "Expected Error:", error.message );
                    break;
                    default:
                        console.log( "Unexpected Error:", error.message );
                    break;
                }
            }
        )
        .finally( pollQueueForMessages );
    })();

    function workflowError( type, error ) {
        error.type = type;
        return( error );
    }
}  

var receiveMessage = Q.nbind( sqs.receiveMessage, sqs );
var deleteMessage = Q.nbind( sqs.deleteMessage, sqs );
var sendMessageTarget1 = Q.nbind( sqsTarget1.sendMessage, sqsTarget1 );
var sendMessageTarget2 = Q.nbind( sqsTarget2.sendMessage, sqsTarget2 );

