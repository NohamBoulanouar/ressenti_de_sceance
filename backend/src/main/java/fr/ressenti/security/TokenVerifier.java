package fr.ressenti.security;

/** Vérifie un jeton d'identité Firebase et renvoie l'utilisateur authentifié. */
public interface TokenVerifier {

    AuthUser verify(String idToken) throws InvalidTokenException;

    class InvalidTokenException extends Exception {
        public InvalidTokenException(String message) {
            super(message);
        }
    }
}
