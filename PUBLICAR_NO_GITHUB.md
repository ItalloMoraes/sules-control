# Subir para o GitHub

1. No GitHub, crie um repositório **vazio** chamado `sules-control` (sem README, sem .gitignore).
2. Dentro da pasta do projeto:

```bash
git init
git add .
git commit -m "Sules Control: sistema completo com movimento"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/sules-control.git
git push -u origin main
```

3. Rode `npm install` e `npm run build` uma vez para conferir antes de publicar na Vercel.
