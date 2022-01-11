# Reproducing the redstone-smartweave cache issue experimented at Pianity

This repository present a very simpled down version of how transactions are run at Pianity in
order to demonstrate the issue we have with *redstone-smartweave*.

The problem demonstrated here is the following: when running a number of concurrent contract
interactions after having initialized the *redstone-smartweave* client, reading the state of the
state of the contract yields wrong results.

**This is demonstrated here by:**

1. setting up an arlocal instance with an erc1155 contract;
2. setting up an initial *redstone-smartweave* client;
3. transfering tokens to an address by concurently running 100 transactions that each transfers 1
   token to said address;
6. setting up a fresh *redstone-smartweave* instance;
4. reading the state using *smartweave v1*;
5. reading the state using the initial *redstone-smartweave* client;
7. reading the state using the fresh instance;

**Notes:**

- The arlocal instance simulate the mining of a block approximately every 0.5 seconds.
- A limit of 10 transactions are created and sent concurently. When the number of running
  transactions drops below 10, new ones starts to be processed, until the total of transactions
  sent is equal to 100.

The expected result is that steps 4, 5 and 7 shows that the amount of tokens received by the
address they were sent to is 100. However, the result yielded by step 5 doesn't match this
expectation, which we believe is the illustration of the issue we're experimenting.

# Running the experiment

Steps to run the demonstration:

1. `yarn install`
1. `yarn start --run-arlocal`
1. in a different terminal, `yarn start --run-experiment`

# Extra

When experimenting with this I was initialy experimenting with an *arlocal* instance running in a
separate package and thus in a separate *node* process. When writing this repo, my goal
was to unify the two pieces (the experiment and the *arlocal* instance) into one repo. As a
result I was now running the experiment and the *arlocal* instance inside a unique *node*
process. When running the experiment in this configuration I was surprised to see that I
couldn't successfully reproduce the bug (*step 5* yielded the correct result). I suspect this is
because *arlocal* and the experiment are now sharing the same thread and therefore the
experiment cannot run as fast as needed to reproduce the bug but I'm not 100% sure here. I
don't think this is really relevant to our issue but I still thought I would share this just in
case. You can try this configuration by running `yarn start --run-both` which will run both the
experiment and *arlocal*'s instance in the same process.
