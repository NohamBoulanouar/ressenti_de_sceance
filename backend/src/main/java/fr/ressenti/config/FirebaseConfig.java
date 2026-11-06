package fr.ressenti.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.FirestoreOptions;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.cloud.FirestoreClient;
import fr.ressenti.security.EmulatorTokenVerifier;
import fr.ressenti.security.FirebaseTokenVerifier;
import fr.ressenti.security.TokenVerifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;

/**
 * Deux modes :
 * - émulateur (local) : Firestore pointe sur l'émulateur, les jetons de l'émulateur Auth sont décodés sans signature ;
 * - production : identifiants Google (GOOGLE_APPLICATION_CREDENTIALS) et vérification réelle des jetons.
 */
@Configuration
public class FirebaseConfig {

    private static final Logger log = LoggerFactory.getLogger(FirebaseConfig.class);

    private final AppProperties.Firebase props;

    public FirebaseConfig(AppProperties appProperties) {
        this.props = appProperties.firebase();
    }

    @Bean
    public Firestore firestore() throws IOException {
        if (props.emulator()) {
            log.warn("Mode ÉMULATEUR : Firestore sur {} (projet {})", props.firestoreEmulatorHost(), props.projectId());
            return FirestoreOptions.newBuilder()
                    .setProjectId(props.projectId())
                    .setEmulatorHost(props.firestoreEmulatorHost())
                    .build()
                    .getService();
        }
        return FirestoreClient.getFirestore(firebaseApp());
    }

    @Bean
    public TokenVerifier tokenVerifier(ObjectMapper mapper) throws IOException {
        if (props.emulator()) {
            return new EmulatorTokenVerifier(mapper, props.projectId());
        }
        return new FirebaseTokenVerifier(FirebaseAuth.getInstance(firebaseApp()));
    }

    private FirebaseApp firebaseApp() throws IOException {
        if (!FirebaseApp.getApps().isEmpty()) {
            return FirebaseApp.getInstance();
        }
        FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(GoogleCredentials.getApplicationDefault())
                .setProjectId(props.projectId())
                .build();
        return FirebaseApp.initializeApp(options);
    }
}
