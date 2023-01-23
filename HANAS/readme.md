# What is this?

Simulating a primary backup model that tries to achieve a HA-NAS, but instead of a storage system
we used a dictionary system based on files.

There are two main components, the overseer and the workerkers.

Although the paper didn't provide information about how service discovery works, we used an overseer to communicate the sync.

## Overseer 

The overseer runs first, then the first server that tries to become the main will become the main server, then the others who try to the same will be added
to a pool just for visualisation purposes but will get back the main server ip. When the primary system fails, when a backup observes after it tries to see if the primary failed or just the link, it sends back the previous main ip and the overseer will clear the servers and set that server as the main.

## Worker

Workers, first find who the main server is. If they are the main server they will have the responsibility of sending keep alive requests to the backups and to reply to all get and set requests.

Primary servers, after not getting a keep alive request will create a file in the communications folder, if after a period see that the file is still there, that means the primary failed and not just the link and will try to become the main.

## How to use

We provided Docker images and a Docker compose.

Build:
  * docker-compose up --build --always-recreate-deps
Sometimes I needed to use to clear a stubborn volume that doesn't want to be created:
  * docker system prune

There are two network created, one which connects all of the containers and one which simulates the link between the two servers.

By just running we get normal behaviour

Docker is ideal if you want to test the behaviour of a failing link, that is disconnecting the link between the two worker containers using `docker network disconnect [name] [containerid]` on both the all network and worker_worker2 network. We will see that the ping fails and the primary backup will try to see if the main server is still up. If it's up it will continue to redirect to the primary backup. There would be plenty of options to expand upon this sharing directory communication.

Testing on a local machine is better if you want to test killing containers, there would be scenarios in which you kill the main, backup takes over, you add another server or add the primary back and try to play around with this.

For each worker it is required to have the following env values set:
  * PORT=3002
  * OVERSEER_IP=http://localhost:4000

We can use `npx ts-node index.ts` to run each worker


Backups will always redirect to the main server as the primary backup approach suggests.

All in all, this way of creating a backup method of recovery allows us to recover. For example, this method allows to identify an issue with the communication link, this way we can alert someone that a link failed and by knowing wheter or not the primary is still alive we know how urgent the issue is and what must be done.s
