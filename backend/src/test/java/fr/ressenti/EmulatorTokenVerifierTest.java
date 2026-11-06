package fr.ressenti;

import com.fasterxml.jackson.databind.ObjectMapper;
import fr.ressenti.security.AuthUser;
import fr.ressenti.security.EmulatorTokenVerifier;
import fr.ressenti.security.TokenVerifier;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class EmulatorTokenVerifierTest {

    private final EmulatorTokenVerifier verifier = new EmulatorTokenVerifier(new ObjectMapper(), "demo-ressenti");

    private static String token(String aud, long exp) {
        String payload = "{\"aud\":\"" + aud + "\",\"exp\":" + exp + ",\"sub\":\"u1\",\"email\":\"a@b.fr\"}";
        Base64.Encoder enc = Base64.getUrlEncoder().withoutPadding();
        return enc.encodeToString("{\"alg\":\"none\"}".getBytes(StandardCharsets.UTF_8)) + "."
                + enc.encodeToString(payload.getBytes(StandardCharsets.UTF_8)) + ".";
    }

    @Test
    void acceptsValidEmulatorToken() throws Exception {
        AuthUser u = verifier.verify(token("demo-ressenti", Instant.now().getEpochSecond() + 3600));
        assertEquals("u1", u.uid());
        assertEquals("a@b.fr", u.email());
    }

    @Test
    void rejectsOtherProjectAndExpired() {
        assertThrows(TokenVerifier.InvalidTokenException.class,
                () -> verifier.verify(token("autre-projet", Instant.now().getEpochSecond() + 3600)));
        assertThrows(TokenVerifier.InvalidTokenException.class,
                () -> verifier.verify(token("demo-ressenti", Instant.now().getEpochSecond() - 10)));
        assertThrows(TokenVerifier.InvalidTokenException.class, () -> verifier.verify("pas-un-jeton"));
    }
}
