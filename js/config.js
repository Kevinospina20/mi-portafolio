// Personaliza estos datos. Las redes con URL "#" se muestran como sugerencias sin enlace.
export const config = {
  profile: {
    name: "Kevin",
    firstName: "Kevin",
    role: "Tu profesión, a tu manera",
    location: "Colombia",
    shortBio: "Construyo ideas con intención, curiosidad y atención a los detalles.",
    intro: "Un espacio para compartir mi recorrido, lo que me inspira y los proyectos que estoy construyendo.",
    email: "",
    quote: "Las buenas ideas toman forma cuando les damos el espacio para crecer.",
    stats: { years: "—", projects: "—" },
    experience: [],
    education: [],
    skills: [
      { name: "Comunicación", level: 80, group: "PERSONALES" },
      { name: "Resolución de problemas", level: 75, group: "PERSONALES" },
      { name: "Aprendizaje continuo", level: 90, group: "PERSONALES" },
    ],
  },
  githubUsername: "TU_USUARIO_GITHUB",
  // Instagram: https://instagram.com/usuario | LinkedIn: https://linkedin.com/in/usuario
  // Discord: https://discord.com/users/ID (tu ID numérico). Deja "#" para ocultar.
  socials: [
    { name: "Instagram", handle: "Tu espacio visual", url: "#", icon: "instagram", color: "coral" },
    { name: "Discord", handle: "Conversemos por aquí", url: "#", icon: "discord", color: "violet" },
    { name: "LinkedIn", handle: "Conecta conmigo", url: "#", icon: "linkedin", color: "blue" },
    { name: "GitHub", handle: "Código e ideas", url: "#", icon: "github", color: "lime" },
  ],
  supabase: {
  url: "https://yukislikggfrgmkbrueh.supabase.co",
  publishableKey: "sb_publishable_LkxthckV0s83lxkk63m2Qw_7wcbfMnr",
  contentTable: "portfolio_content",
  contentId: "main",
  certificatesTable: "portfolio_certificates",
  certificatesBucket: "certificates",
  certificateMaxFileSizeMB: 10,
},
};
