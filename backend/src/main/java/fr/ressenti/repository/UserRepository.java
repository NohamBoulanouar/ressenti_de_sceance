package fr.ressenti.repository;

import com.google.cloud.firestore.CollectionReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import fr.ressenti.model.Role;
import fr.ressenti.model.UserProfile;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public class UserRepository {

    private final CollectionReference users;

    public UserRepository(Firestore db) {
        this.users = db.collection("users");
    }

    public Optional<UserProfile> findById(String uid) {
        DocumentSnapshot doc = Futures.await(users.document(uid).get());
        return doc.exists() ? Optional.of(map(doc)) : Optional.empty();
    }

    public List<UserProfile> findAll() {
        return Futures.await(users.get()).getDocuments().stream().map(UserRepository::map).toList();
    }

    public boolean anyCoach() {
        return !Futures.await(users.whereEqualTo("role", Role.COACH.name()).limit(1).get()).isEmpty();
    }

    public long countCoaches() {
        return Futures.await(users.whereEqualTo("role", Role.COACH.name()).get()).size();
    }

    public void save(UserProfile u) {
        Map<String, Object> data = new HashMap<>();
        data.put("email", u.email());
        data.put("name", u.name());
        data.put("poste", u.poste());
        data.put("role", u.role().name());
        data.put("createdAt", u.createdAt());
        Futures.await(users.document(u.uid()).set(data));
    }

    private static UserProfile map(DocumentSnapshot d) {
        String role = d.getString("role");
        return new UserProfile(d.getId(), d.getString("email"), d.getString("name"), d.getString("poste"),
                role == null ? Role.ATHLETE : Role.valueOf(role), d.getString("createdAt"));
    }
}
