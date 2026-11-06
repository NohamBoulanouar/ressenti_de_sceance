package fr.ressenti.web;

import fr.ressenti.model.Requests;
import fr.ressenti.model.UserProfile;
import fr.ressenti.security.AuthUser;
import fr.ressenti.service.UserService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Gestion des comptes, réservée aux coachs. */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService users;

    public UserController(UserService users) {
        this.users = users;
    }

    @GetMapping
    public List<UserProfile> list(AuthUser auth) {
        return users.listAll(auth);
    }

    @PatchMapping("/{uid}/role")
    public UserProfile changeRole(AuthUser auth, @PathVariable String uid, @Valid @RequestBody Requests.ChangeRole body) {
        return users.changeRole(auth, uid, body.role());
    }
}
