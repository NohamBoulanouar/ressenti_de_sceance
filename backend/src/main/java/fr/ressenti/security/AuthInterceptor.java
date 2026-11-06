package fr.ressenti.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/** Toutes les routes /api/** exigent un en-tête "Authorization: Bearer <jeton Firebase>". */
@Component
public class AuthInterceptor implements HandlerInterceptor {

    static final String ATTR = "authUser";

    private final TokenVerifier verifier;

    public AuthInterceptor(TokenVerifier verifier) {
        this.verifier = verifier;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            return true; // pré-requête CORS
        }
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            return reject(response, "Connexion requise");
        }
        try {
            request.setAttribute(ATTR, verifier.verify(header.substring(7).trim()));
            return true;
        } catch (TokenVerifier.InvalidTokenException e) {
            return reject(response, e.getMessage());
        }
    }

    private boolean reject(HttpServletResponse response, String message) throws Exception {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"error\":\"" + message.replace("\"", "'") + "\"}");
        return false;
    }
}
