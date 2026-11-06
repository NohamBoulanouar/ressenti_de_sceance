package fr.ressenti.service;

import fr.ressenti.model.Postes;
import fr.ressenti.model.Requests;
import fr.ressenti.model.Role;
import fr.ressenti.model.UserProfile;
import fr.ressenti.repository.UserRepository;
import fr.ressenti.security.AuthUser;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;

@Service
public class UserService {

    private final UserRepository users;

    public UserService(UserRepository users) {
        this.users = users;
    }

    public UserProfile get(AuthUser auth) {
        return users.findById(auth.uid())
                .orElseThrow(() -> ApiException.notFound("Profil à compléter"));
    }

    public UserProfile requireCoach(AuthUser auth) {
        UserProfile me = get(auth);
        if (!me.isCoach()) {
            throw ApiException.forbidden("Réservé aux coachs");
        }
        return me;
    }

    /**
     * Crée ou met à jour le profil. Le rôle n'est JAMAIS choisi par l'utilisateur :
     * le tout premier compte de l'équipe devient coach, les suivants sont athlètes.
     */
    public synchronized UserProfile saveProfile(AuthUser auth, Requests.Profile req) {
        if (!Postes.ALL.contains(req.poste())) {
            throw ApiException.badRequest("Poste inconnu");
        }
        UserProfile updated = users.findById(auth.uid())
                .map(u -> new UserProfile(u.uid(), auth.email(), req.name().trim(), req.poste(), u.role(), u.createdAt()))
                .orElseGet(() -> new UserProfile(auth.uid(), auth.email(), req.name().trim(), req.poste(),
                        users.anyCoach() ? Role.ATHLETE : Role.COACH, Instant.now().toString()));
        users.save(updated);
        return updated;
    }

    public List<UserProfile> listAll(AuthUser coach) {
        requireCoach(coach);
        return users.findAll().stream()
                .sorted(Comparator.comparing(UserProfile::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    public synchronized UserProfile changeRole(AuthUser coach, String targetUid, Role role) {
        requireCoach(coach);
        UserProfile target = users.findById(targetUid)
                .orElseThrow(() -> ApiException.notFound("Compte introuvable"));
        if (target.role() == Role.COACH && role == Role.ATHLETE && users.countCoaches() <= 1) {
            throw ApiException.badRequest("Il doit rester au moins un coach");
        }
        UserProfile updated = new UserProfile(target.uid(), target.email(), target.name(), target.poste(), role, target.createdAt());
        users.save(updated);
        return updated;
    }
}
