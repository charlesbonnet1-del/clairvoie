// Repeuple les données de démo pendant le build, mais uniquement si
// SEED_ON_BUILD=true est explicitement défini (variable d'environnement,
// plus fiable qu'une commande de build personnalisée dans le dashboard
// Vercel). Volontairement opt-in : `prisma db seed` réinitialise les
// données existantes, ce qu'on ne veut jamais déclencher par erreur sur une
// base contenant de vraies données.
const { execSync } = require("child_process");

if (process.env.SEED_ON_BUILD === "true") {
  console.log("SEED_ON_BUILD=true — exécution de prisma db seed…");
  execSync("npx prisma db seed", { stdio: "inherit" });
} else {
  console.log(
    "SEED_ON_BUILD non défini à 'true' — seed ignoré (voir README pour l'activer)."
  );
}
