package fr.ressenti.service;

import fr.ressenti.model.Requests;
import fr.ressenti.model.SessionResponse;
import fr.ressenti.model.UserProfile;
import fr.ressenti.repository.ResponseRepository;
import fr.ressenti.security.AuthUser;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

@Service
public class ResponseService {

    private static final ZoneId PARIS = ZoneId.of("Europe/Paris");

    private final ResponseRepository responses;
    private final UserService users;

    public ResponseService(ResponseRepository responses, UserService users) {
        this.responses = responses;
        this.users = users;
    }

    public record SaveResult(SessionResponse response, boolean updated) {
    }

    /** Une seule réponse par athlète et par date : renvoyer pour la même date remplace la précédente. */
    public SaveResult submit(AuthUser auth, Requests.Session s) {
        UserProfile me = users.get(auth);
        if (s.date().isAfter(LocalDate.now(PARIS))) {
            throw ApiException.badRequest("La date de séance ne peut pas être dans le futur");
        }
        String date = s.date().toString();
        String id = SessionResponse.idOf(me.uid(), date);
        boolean existed = responses.exists(id);
        String gene = s.gene() == null ? "" : s.gene().trim();
        SessionResponse r = new SessionResponse(id, me.uid(), me.name(), me.poste(), date,
                s.mus(), s.car(), s.rep(), s.conc(), s.pla(), s.conf(), s.tec(), s.tac(), s.opp(),
                s.blessure(), gene, Instant.now().toString());
        responses.save(r);
        return new SaveResult(r, existed);
    }

    public List<SessionResponse> mine(AuthUser auth, int limit) {
        users.get(auth);
        return responses.findByUid(auth.uid()).stream().limit(Math.max(1, Math.min(limit, 200))).toList();
    }

    public List<SessionResponse> team(AuthUser auth, String from, String to) {
        users.requireCoach(auth);
        return responses.findBetween(blankToNull(from), blankToNull(to));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
