# Deploy the Clarion Net API

## First time only

1. Install flyctl:
   ```
   curl -L https://fly.io/install.sh | sh
   ```
2. Log in:
   ```
   fly auth login
   ```

## Every deploy

```
cd Clarion-Api
git pull
fly deploy
```

That's it. Fly reads fly.toml and ships it.
