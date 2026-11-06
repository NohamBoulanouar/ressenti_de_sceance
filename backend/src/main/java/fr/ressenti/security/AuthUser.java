package fr.ressenti.security;

/** Utilisateur authentifié par Firebase (identifiant + email). */
public record AuthUser(String uid, String email) {
}
