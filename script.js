// Remplacez les valeurs ci-dessous par les vôtres
const SUPABASE_URL = 'https://xiqgxkpymztunrkrwxkv.supabase.co'; // Collez votre URL ici
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpcWd4a3B5bXp0dW5ya3J3eGt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MDE3ODYsImV4cCI6MjA2ODE3Nzc4Nn0.CZhbS2B_31KQQWo73KBCrttoc8qEY3n_-a_LCjk5TJQ'; // Collez votre clé ici

let supabase; // Déclaration globale de supabase

// Fonction d'initialisation de Supabase
function initializeSupabase() {
    // Vérifier si Supabase est déjà défini (pour éviter les erreurs si la page est rechargée rapidement ou double appelée)
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        // Si window.supabase n'est pas encore prêt, réessayez après un court délai
        console.warn("Supabase n'est pas encore prêt, réessai dans 100ms...");
        setTimeout(initializeSupabase, 100);
    }
}

// Appeler la fonction d'initialisation dès que le script est exécuté
initializeSupabase();

document.addEventListener('DOMContentLoaded', async () => {
    // Assurez-vous que Supabase est initialisé avant de continuer
    // Cette boucle va attendre que l'objet supabase soit bien défini
    while (!supabase) {
        console.log("Attente de l'initialisation de Supabase...");
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    console.log("Supabase est initialisé. L'application démarre.");

    const formAjoutProduit = document.getElementById('form-ajout-produit');
    const corpsTableau = document.getElementById('corps-tableau');
    const SEUIL_STOCK_FAIBLE = 10;
    
    // Affiche l'inventaire au chargement
    afficherInventaire();

    /**
     * Récupère les produits depuis la base de données Supabase et les affiche
     */
    async function afficherInventaire() {
        corpsTableau.innerHTML = '<tr><td colspan="5">Chargement...</td></tr>';

        // Récupère les données de la table 'produits', triées par catégorie
        const { data: produits, error } = await supabase
            .from('produits')
            .select('*')
            .order('categorie', { ascending: true });

        if (error) {
            console.error('Erreur lors de la récupération:', error);
            // Afficher un message d'erreur plus clair pour l'utilisateur
            corpsTableau.innerHTML = `<tr><td colspan="5">Erreur de chargement des produits : ${error.message}. Vérifiez la console.</td></tr>`;
            return;
        }

        corpsTableau.innerHTML = ''; // Vide le tableau
        if (produits.length === 0) {
            corpsTableau.innerHTML = '<tr><td colspan="5">Aucun produit dans l\'inventaire.</td></tr>';
            return;
        }

        produits.forEach(produit => {
            const tr = document.createElement('tr');
            let statutTexte = 'En Stock';
            let statutClasse = 'statut-ok';
            if (produit.stock <= 0) {
                statutTexte = 'EN RUPTURE';
                statutClasse = 'statut-rupture';
            } else if (produit.stock <= SEUIL_STOCK_FAIBLE) {
                statutTexte = 'Stock Faible';
                statutClasse = 'statut-faible';
            }

            // Important: on utilise produit.id qui vient de la base de données
            tr.innerHTML = `
                <td>${produit.nom}</td>
                <td>${produit.categorie}</td>
                <td>${produit.stock}</td>
                <td class="${statutClasse}">${statutTexte}</td>
                <td>
                    <button class="btn-action btn-ajouter" data-id="${produit.id}" data-stock="${produit.stock}">+</button>
                    <button class="btn-action btn-retirer" data-id="${produit.id}" data-stock="${produit.stock}">-</button>
                    <button class="btn-action btn-supprimer" data-id="${produit.id}" data-nom="${produit.nom}">🗑️</button>
                </td>
            `;
            corpsTableau.appendChild(tr);
        });
    }

    /**
     * Ajoute un produit dans la base de données
     */
    formAjoutProduit.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nom = document.getElementById('nom-produit').value.trim();
        const stock = parseInt(document.getElementById('stock-initial').value, 10);
        const categorie = document.getElementById('categorie-produit').value;

        // Vérification si le nom existe déjà avant d'ajouter
        // Il faut aller chercher les produits à jour dans la BDD pour cette vérification
        const { data: existingProducts, error: fetchError } = await supabase
            .from('produits')
            .select('nom')
            .eq('nom', nom); // Cherche un produit avec le même nom

        if (fetchError) {
            console.error('Erreur lors de la vérification du produit existant:', fetchError);
            alert('Une erreur est survenue lors de la vérification. Veuillez réessayer.');
            return;
        }

        if (existingProducts && existingProducts.length > 0) {
            alert('Erreur : Ce produit existe déjà dans l\'inventaire.');
            return;
        }


        // Insère les données dans la table 'produits'
        const { error } = await supabase.from('produits').insert([{ nom, stock, categorie }]);

        if (error) {
            console.error('Erreur lors de l\'ajout:', error);
            alert('Une erreur est survenue lors de l\'ajout. Vérifiez la console pour plus de détails.');
        } else {
            formAjoutProduit.reset();
            afficherInventaire(); // Rafraîchit la liste
        }
    });

    /**
     * Gère les clics pour ajouter/retirer/supprimer
     */
    corpsTableau.addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;
        if (!id) return; // Si on n'a pas cliqué sur un bouton avec un data-id

        // Logique de suppression
        if (target.classList.contains('btn-supprimer')) {
            const nomProduit = target.dataset.nom;
            if (confirm(`Êtes-vous sûr de vouloir supprimer le produit "${nomProduit}" ?`)) {
                const { error } = await supabase.from('produits').delete().eq('id', id);
                if (error) {
                    console.error('Erreur lors de la suppression:', error);
                    alert('Une erreur est survenue lors de la suppression. Vérifiez la console.');
                }
                afficherInventaire();
            }
            return; // Arrête l'exécution pour ne pas déclencher le prompt suivant
        }

        // Logique pour ajouter/retirer du stock
        if (target.classList.contains('btn-ajouter') || target.classList.contains('btn-retirer')) {
            const quantiteStr = prompt("Quelle quantité ?", "1");
            if (!quantiteStr) return;

            const quantite = parseInt(quantiteStr, 10);
            if (isNaN(quantite) || quantite <= 0) {
                alert("Veuillez entrer un nombre valide.");
                return;
            }
            
            let stockActuel = parseInt(target.dataset.stock, 10);
            let nouveauStock = target.classList.contains('btn-ajouter') 
                ? stockActuel + quantite 
                : stockActuel - quantite;

            // Met à jour le stock dans la base de données
            const { error } = await supabase.from('produits').update({ stock: nouveauStock }).eq('id', id);
            if (error) {
                console.error('Erreur lors de la mise à jour du stock:', error);
                alert('Une erreur est survenue lors de la mise à jour du stock. Vérifiez la console.');
            }
            afficherInventaire();
        }
    });
});