/* ==========================================================================
   CONFIGURATION DE L'ENQUÊTE
   C'est le seul fichier (avec questions.json) que vous devez modifier.
   Les textes sont fournis par langue : ajoutez une clé par langue activée.
   ========================================================================== */

window.SURVEY_CONFIG = {
  // Identifiant technique de l'enquête (sans espaces). Sert à nommer le brouillon local
  // et à classer les réponses côté serveur.
  surveyId: "mkt-localization-2026",

  // Langues proposées. Le code doit correspondre aux clés utilisées dans questions.json.
  // Avec une seule langue, le sélecteur de langue est masqué.
  languages: [
    { code: "en", label: "English" }
  ],
  defaultLanguage: "en",

  title: {
    en: "Marketing Localization survey 2026"
  },

  intro: {
    en: [
      "Thank you for taking the time to share your feedback with us.",
      "The Marketing Localization team strives to continuously improve the quality, efficiency, and visibility of our services to better support your local marketing activities.",
      "This short survey aims to gather your insights on our current processes, tools, and communication. Your input is essential to help us identify what works well and where we can enhance our collaboration.",
      "Please answer as openly and honestly as possible: your responses will remain confidential and will only be used for improvement purposes.",
      "Thank you for your valuable contribution!"
    ]
  },

  duration: {
    en: "Takes about 5 minutes."
  },

  // Texte de confidentialité affiché sur la première page. Les deux phrases décrivent ce que fait
  // réellement le code ; faites valider le texte par votre DPO / service juridique.
  privacy: {
    en: [
      "Your responses are confidential and will only be used to improve our services.",
      "This survey does not collect your name, e-mail address or IP address."
    ]
  },

  thanks: {
    en: [
      "Thank you for completing the survey! We truly appreciate your time and your feedback.",
      "Your input will help us refine our processes, strengthen collaboration, and ensure that our localization services continue to meet your needs.",
      "Thank you again for your support and partnership! The Marketing Localization Team"
    ]
  },

  // URL de la fonction d'enregistrement (voir README.md, étape 4).
  // Laissez vide pour tester : les réponses ne sont alors pas envoyées mais affichées à l'écran.
  endpoint: "",

  // true : l'utilisateur doit saisir un code d'accès (à définir côté serveur) pour envoyer ses réponses.
  requireAccessCode: false,

  // false : un seul envoi par navigateur. Mettez true pendant vos tests, false pour la vraie campagne.
  allowMultiple: true,

  questionsFile: "questions.json"
};
