package fr.ressenti.web;

import fr.ressenti.model.Postes;
import fr.ressenti.model.Requests;
import fr.ressenti.model.UserProfile;
import fr.ressenti.security.AuthUser;
import fr.ressenti.service.UserService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class MeController {

    private final UserService users;

    public MeController(UserService users) {
        this.users = users;
    }

    /** 404 tant que le profil (nom + poste) n'a pas été complété. */
    @GetMapping("/me")
    public UserProfile me(AuthUser auth) {
        return users.get(auth);
    }

    @PutMapping("/me")
    public UserProfile saveProfile(AuthUser auth, @Valid @RequestBody Requests.Profile req) {
        return users.saveProfile(auth, req);
    }

    @GetMapping("/postes")
    public List<String> postes() {
        return Postes.ALL;
    }
}
