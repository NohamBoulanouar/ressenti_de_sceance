package fr.ressenti.security;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;

/** Vérification réelle (signature, expiration, projet) via le SDK Firebase Admin. */
public class FirebaseTokenVerifier implements TokenVerifier {

    private final FirebaseAuth auth;

    public FirebaseTokenVerifier(FirebaseAuth auth) {
        this.auth = auth;
    }

    @Override
    public AuthUser verify(String idToken) throws InvalidTokenException {
        try {
            FirebaseToken token = auth.verifyIdToken(idToken);
            return new AuthUser(token.getUid(), token.getEmail());
        } catch (FirebaseAuthException | IllegalArgumentException e) {
            throw new InvalidTokenException("Jeton invalide");
        }
    }
}
