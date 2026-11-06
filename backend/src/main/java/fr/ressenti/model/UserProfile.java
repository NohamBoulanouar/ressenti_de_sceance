package fr.ressenti.model;

import com.fasterxml.jackson.annotation.JsonIgnore;

/** Document Firestore users/{uid}. */
public record UserProfile(String uid, String email, String name, String poste, Role role, String createdAt) {

    @JsonIgnore
    public boolean isCoach() {
        return role == Role.COACH;
    }
}
