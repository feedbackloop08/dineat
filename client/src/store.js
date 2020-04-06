import Vue from "vue";
import Vuex from "vuex";
import router from "./router";

Vue.use(Vuex);

const store = new Vuex.Store({
  state: {
    user: {
      username: "",
      cookie: ""
    },
    resMin: [],
    restaurants: []
  },
  mutations: {

    setUser (state, payload) {
      Object.assign(state.user, payload)
    },

    setRestaurants (state, eateries) {
      state.restaurants = eateries
    },

    minifier (state) {
      if (state.resMin.length) {
        return;
      }
      state.restaurants.forEach(restaurant => {
        let combined = "";
        for (const prop in restaurant) {
          combined += restaurant[prop];
        }
        state.resMin.push(combined.replace(/\s+/g, "").toLowerCase());
      });
    },

    sessionStarted (state) {
      const check = setInterval(() => {
        if (document.cookie !== state.user.cookie) {
          if (router.currentRoute.name !== "Login") {
              router.push("/login").catch(err => console.log(err))
          }
          clearInterval(check);
        }
      }, 1000);
    },

    sessionEnded (state) {
      Object.assign(state.user, {username: '', cookie: ''})
    }
  },

  getters: {
    fetchRestaurants (state) {
      return state.restaurants;
    },

    searchRestaurant: state => sentence => {
      store.commit("minifier");
      const lexicons = sentence.split(" ").filter(token => token.length >= 3);
      const arr = [];
      lexicons.forEach(lexicon => {
        state.resMin.forEach((restaurant, index) => {
          if (restaurant.includes(lexicon)) {
            if (!arr.includes(index)) {
              arr.push(state.restaurants[index]);
            }
          }
        });
      });
      return arr;
    }
  },
  actions: {
    async grabRestaurants (context, state) {
      const req = await fetch('/master/pull', {
        method: 'POST',
        headers: {
          'Accept': 'application/JSON',
        },
        credentials: 'same-origin'
      })
      const payload = await req.json()
      if (payload.valid) {
        context.commit('setRestaurants', payload.places)
      }
    }
  },
  modules: {}
});


export default store;
