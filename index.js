require('dotenv').config()
const express = require("express");

const app = express();

const port = process.env.PORT || 3000;

const githubData = {
  "login": "dnano-more",
  "id": 121574465,
  "node_id": "U_kgDOBz8UQQ",
  "avatar_url": "https://avatars.githubusercontent.com/u/121574465?v=4",
  "gravatar_id": "",
  "url": "https://api.github.com/users/dnano-more",
  "html_url": "https://github.com/dnano-more",
  "followers_url": "https://api.github.com/users/dnano-more/followers",
  "following_url": "https://api.github.com/users/dnano-more/following{/other_user}",
  "gists_url": "https://api.github.com/users/dnano-more/gists{/gist_id}",
  "starred_url": "https://api.github.com/users/dnano-more/starred{/owner}{/repo}",
  "subscriptions_url": "https://api.github.com/users/dnano-more/subscriptions",
  "organizations_url": "https://api.github.com/users/dnano-more/orgs",
  "repos_url": "https://api.github.com/users/dnano-more/repos",
  "events_url": "https://api.github.com/users/dnano-more/events{/privacy}",
  "received_events_url": "https://api.github.com/users/dnano-more/received_events",
  "type": "User",
  "user_view_type": "public",
  "site_admin": false,
  "name": "Dnyaneshwar More",
  "company": null,
  "blog": "",
  "location": null,
  "email": null,
  "hireable": null,
  "bio": "Aspiring Software Developer.",
  "twitter_username": "Coder_dnano",
  "public_repos": 17,
  "public_gists": 0,
  "followers": 3,
  "following": 12,
  "created_at": "2022-12-28T18:03:45Z",
  "updated_at": "2026-04-13T18:52:27Z"
}

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/dnano-site", (req, res) => {
    res.send("This is dnano's porfolio site")
})

app.get("/html-page", (req, res) => {
    res.send("<h1>Ham html bhe bhe j sakte hain response me!</h1>")
})

app.get("/youtube", (req, res) => {
    res.send('<h2 style="text-transform: capitalize; color: #e67e00;">chai aur backend</h2>');
})

app.get("/github-profile", (req, res) => {
    res.json(githubData);
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
