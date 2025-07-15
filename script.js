// Remplacez les valeurs ci-dessous par les vôtres
const SUPABASE_URL = 'https://xiqgxkpymztunrkrwxkv.supabase.co'; // Copiez votre URL ici
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpcWd4a3B5bXp0dW5ya3J3eGt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MDE3ODYsImV4cCI6MjA2ODE3Nzc4Nn0.CZhbS2B_31KQQWo73KBCrttoc8qEY3n_-a_LCjk5TJQ'; // Copiez votre clé ici

let supabase; // Déclaration globale de supabase

// Cette fonction va attendre que window.supabase soit disponible
function waitForSupabaseAndInitialize() {
    return new Promise((resolve) => {
        const checkSupabase = () => {
            if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
                supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                console.log("Supabase est initialisé. L'application démarre.");
                resolve();
            } else {
                console.log("Attente de l'initialisation de window.supabase...");
                setTimeout(checkSupabase, 50);
            }
        };
        checkSupabase();
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    await waitForSupabaseAndInitialize();

    const formAjoutProduit = document.getElementById('form-ajout-produit');
    const corpsTableau = document.getElementById('corps-tableau');
    const filtresCategorieDiv = document.getElementById('filtres-categorie');
    const filtresStatutDiv = document.getElementById('filtres-statut'); // Nouveau !
    const SEUIL_STOCK_FAIBLE = 10;

    // Variables pour stocker le filtre actif
    let currentCategoryFilter = 'all';
    let currentStatusFilter = 'all';
    
    // Au chargement, afficher l'inventaire complet (toutes catégories, tous statuts)
    afficherInventaire(currentCategoryFilter, currentStatusFilter); 

    /**
     * Détermine le statut d'un produit basé sur son stock.
     * C'est une fonction utilitaire que nous allons utiliser pour filtrer côté client.
     */
    function getProductStatus(stock) {
        if (stock <= 0) {
            return 'EN RUPTURE';
        } else if (stock <= SEUIL_STOCK_FAIBLE) {
            return 'Stock Faible';
        } else {
            return 'En Stock';
        }
    }

    /**
     * Récupère les produits depuis la base de données Supabase et les affiche
     * @param {string} categorieFilter - La catégorie à filtrer ('all' pour toutes).
     * @param {string} statutFilter - Le statut à filtrer ('all' pour tous).
     */
    async function afficherInventaire(categorieFilter, statutFilter) { // Ajout du paramètre statutFilter
        corpsTableau.innerHTML = '<tr><td colspan="5">Chargement...</td></tr>';

        // On récupère TOUS les produits d'abord, pour pouvoir filtrer par statut côté client
        // Supabase ne peut pas filtrer par une propriété calculée (le statut) directement
        let { data: produits, error } = await supabase
            .from('produits')
            .select('*')
            .order('categorie', { ascending: true }); // Toujours trier par catégorie pour l'ordre

        if (error) {
            console.error('Erreur lors de la récupération:', error);
            corpsTableau.innerHTML = `<tr><td colspan="5">Erreur de chargement des produits : ${error.message || 'Problème de connexion'}.</td></tr>`;
            return;
        }

        // --- FILTRAGE CÔTÉ CLIENT ---
        let produitsFiltres = produits.filter(produit => {
            const matchesCategory = (categorieFilter === 'all' || produit.categorie === categorieFilter);
            const matchesStatus = (statutFilter === 'all' || getProductStatus(produit.stock) === statutFilter);
            return matchesCategory && matchesStatus;
        });

        corpsTableau.innerHTML = '';
        if (produitsFiltres.length === 0) {
            corpsTableau.innerHTML = '<tr><td colspan="5">Aucun produit ne correspond aux filtres.</td></tr>'; // Message adapté
            return;
        }

        produitsFiltres.forEach(produit => { // Itérer sur les produits filtrés
            const tr = document.createElement('tr');
            let statutTexte = getProductStatus(produit.stock); // Utilise la nouvelle fonction
            let statutClasse = 'statut-ok';
            if (produit.stock <= 0) {
                statutClasse = 'statut-rupture';
            } else if (produit.stock <= SEUIL_STOCK_FAIBLE) {
                statutClasse = 'statut-faible';
            }
            
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

    // Gestion du clic sur les boutons de catégorie
    filtresCategorieDiv.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('btn-categorie')) {
            // Mise à jour de la classe active
            document.querySelectorAll('.btn-categorie').forEach(btn => btn.classList.remove('active'));
            target.classList.add('active');

            currentCategoryFilter = target.dataset.categorie; // Met à jour le filtre de catégorie
            afficherInventaire(currentCategoryFilter, currentStatusFilter); // Affiche les produits filtrés avec le statut actuel
        }
    });

    // NOUVEAU : Gestion du clic sur les boutons de statut
    filtresStatutDiv.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('btn-statut')) {
            // Mise à jour de la classe active
            document.querySelectorAll('.btn-statut').forEach(btn => btn.classList.remove('active'));
            target.classList.add('active');

            currentStatusFilter = target.dataset.statut; // Met à jour le filtre de statut
            afficherInventaire(currentCategoryFilter, currentStatusFilter); // Affiche les produits filtrés avec la catégorie actuelle
        }
    });


    formAjoutProduit.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const nom = document.getElementById('nom-produit').value.trim();
        const stock = parseInt(document.getElementById('stock-initial').value, 10);
        const categorie = document.getElementById('categorie-produit').value;

        if (categorie === "") {
            alert('Erreur : Veuillez sélectionner une catégorie.');
            return;
        }
        
        const { data: existingProducts, error: fetchError } = await supabase
            .from('produits')
            .select('nom')
            .eq('nom', nom);

        if (fetchError) {
            console.error('Erreur lors de la vérification du produit existant:', fetchError);
            alert('Une erreur est survenue lors de la vérification. Veuillez réessayer.');
            return;
        }

        if (existingProducts && existingProducts.length > 0) {
            alert('Erreur : Ce produit existe déjà dans l\'inventaire.');
            return;
        }

       const { error } = await supabase.from('produits').insert([{ nom, stock, categorie }]);
        
        if (error) {
            console.error('Erreur lors de l\'ajout:', error);
            alert('Une erreur est survenue lors de l\'ajout : ' + error.message);
        } else {
            formAjoutProduit.reset(); 
            // Après l'ajout, on réinitialise les filtres à "all" et on rafraîchit
            document.querySelectorAll('.btn-categorie').forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.categorie === 'all') btn.classList.add('active');
            });
            document.querySelectorAll('.btn-statut').forEach(btn => { // Réinitialise aussi les statuts
                btn.classList.remove('active');
                if (btn.dataset.statut === 'all') btn.classList.add('active');
            });
            currentCategoryFilter = 'all';
            currentStatusFilter = 'all';
            afficherInventaire(currentCategoryFilter, currentStatusFilter); 
        }
    });
    
    corpsTableau.addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;
        if (id === undefined) return;

        if (target.classList.contains('btn-supprimer')) {
            const nomProduit = target.dataset.nom;
            if (confirm(`Êtes-vous sûr de vouloir supprimer le produit "${nomProduit}" ?`)) {
                const { error } = await supabase.from('produits').delete().eq('id', id);
                if (error) {
                    console.error('Erreur lors de la suppression:', error);
                    alert('Une erreur est survenue lors de la suppression : ' + error.message);
                }
                // Après suppression, on rafraîchit avec les filtres ACTUELS
                afficherInventaire(currentCategoryFilter, currentStatusFilter);
            }
            return;
        }

        const quantiteStr = prompt("Quelle quantité ?", "1");
        if (quantiteStr === null) return;

        const quantite = parseInt(quantiteStr, 10);
        if (isNaN(quantite) || quantite <= 0) {
            alert("Veuillez entrer un nombre valide.");
            return;
        }
        
        let stockActuel = parseInt(target.dataset.stock, 10);
        let nouveauStock;
        if (target.classList.contains('btn-ajouter')) {
            nouveauStock = stockActuel + quantite;
        } else if (target.classList.contains('btn-retirer')) {
            nouveauStock = stockActuel - quantite;
        }

        const { error } = await supabase.from('produits').update({ stock: nouveauStock }).eq('id', id);
        if (error) {
            console.error('Erreur lors de la mise à jour du stock:', error);
            alert('Une erreur est survenue lors de la mise à jour du stock : ' + error.message);
        }
        // Après mise à jour du stock, on rafraîchit avec les filtres ACTUELS
        afficherInventaire(currentCategoryFilter, currentStatusFilter);
    });
});