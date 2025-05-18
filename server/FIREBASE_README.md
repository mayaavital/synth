The biggest changes are outlined below.


Maya:
    -The old "gameID" was the invite code that players used to join the game. If you run the app now, you'll see thats been replaced with a new version thats much longer. This new code is now our real "gameID" but you need to change it so that the new invite code is displayed instead.

    You can see where I create generate the new code on lines 138-166 of server.js and see how it gets stored in the activeGames array in lines 182-183.

    -I need you to:
    1.Change the front end so the invite code is displayed to the user on the game lobby screen
    2.Change the Join Game 