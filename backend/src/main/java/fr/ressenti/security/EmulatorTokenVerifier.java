package fr.ressenti.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

/**
 * UNIQUEMENT pour le développement local : l'émulateur Firebase Auth émet des jetons non signés.
 * On lit donc le contenu du jeton et on contrôle le projet et l'expiration, sans vérifier de signature.
 * Ne jamais activer ce mode en production (app.firebase.emulator=false).
 */
public class EmulatorTokenVerifier implements TokenVerifier {

    private final ObjectMapper mapper;
    private final String projectId;

    public EmulatorTokenVerifier(ObjectMapper mapper, String projectId) {
        this.mapper = mapper;
        this.projectId = projectId;
    }

    @Override
    public AuthUser verify(String idToken) throws InvalidTokenException {
        String[] parts = idToken.split("\\.");
        if (parts.length < 2) {
            throw new InvalidTokenException("Jeton mal formé");
        }
        try {
            JsonNode payload = mapper.readTree(new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8));
            if (!projectId.equals(payload.path("aud").asText())) {
                throw new InvalidTokenException("Jeton d'un autre projet");
            }
            if (payload.path("exp").asLong() < Instant.now().getEpochSecond()) {
                throw new InvalidTokenException("Jeton expiré");
            }
            String uid = payload.path("sub").asText(payload.path("user_id").asText());
            if (uid.isBlank()) {
                throw new InvalidTokenException("Jeton sans utilisateur");
            }
            String email = payload.hasNonNull("email") ? payload.get("email").asText() : null;
            return new AuthUser(uid, email);
        } catch (InvalidTokenException e) {
            throw e;
        } catch (Exception e) {
            throw new InvalidTokenException("Jeton illisible");
        }
    }
}
