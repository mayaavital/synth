
const { Module } = require("module")

DATABASE_BRANCHES = {
  ADMIN : 'admin',
  GAME : 'game',
  USER : 'user'
}


class GameDataBranches {

    static GAME_BRANCHES = {
        METADATA : 'metadata',
        GAME_DATA : 'game_data'
    }

    static METADATA = {
        NAME : 'game_name',
        NUM_PLAYERS : 'number_of_players',
        MAX_ROUNDS : 'max_rounds',
        PLAYERS : 'players'
    }

    static GAME_DATA = {
        COMBINED_TRACKS : 'combined_tracks',
        SCORES : 'scores',
        GUESS_TRACKS : 'guess_tracks'
    }
}

class UserDataBranches {
  static USER_DATA = {
    DEVICE_ID : 'device_id',
    TRACKS : 'tracks',
    NAME : 'name'
  }
}

module.exports = {GameDataBranches, UserDataBranches, DATABASE_BRANCHES}



