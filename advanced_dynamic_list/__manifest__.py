# -*- coding: utf-8 -*-
{
    'name': "Advanced Dynamic List",
    'version': '14.0.0.0',
    'author': "medconsultantweb@gmail.com",
    'summary': """
        Advanced Dynamic List" is a user-friendly Odoo module that provides advanced customization options for list views with a simple drag-and-drop menu
    """,

    'description': """
    Advanced Dynamic List" is an Odoo module that allows users to personalize their list view through a drag-and-drop menu of all available fields in the database, sort columns, rename them, and perform advanced searches, including text fields, option fields, and date fields, with the ability to also customize sorting of many-to-one lines such as product lists in quotes or journal entries.
    Advanced Dynamic List" is a user-friendly Odoo module that provides advanced customization options for list views. With a simple drag-and-drop menu, users can choose from all available fields in the database and quickly sort, rename and personalize the columns to suit their needs. The module also enables advanced search capabilities, including text fields, option fields and date fields. Additionally, it allows for customization of many-to-one line sorting, such as in product lists in quotes or journal entries, making it a versatile tool for streamlining workflow and improving efficiency.
            Odoo List View
    Advanced Customization
    Drag-and-drop menu
    Personalized columns
    Available database fields
    Sorting options
    Rename columns
    Advanced search
    Text fields
    Option fields
    Date fields
    Many-to-one line sorting
    Product lists
    Quotes
    Journal entries
    Streamline workflow
    Improve efficiency
    User-friendly interface
    Versatile tool
    Personnalisation avancée, menu glisser-déposer, colonnes personnalisées, champ de base de données disponible, options de tri, renommer les colonnes, recherche avancée, champs de texte, champs d'option, champs de date, tri des lignes many-to-one, listes de produits, devis, entrées de journal, améliorer l'efficacité.
    Advanced Customization, Drag-and-drop menu, Personalized columns, Available database fields, Sorting options, Rename columns, Advanced search, Text fields, Option fields, Date fields, Many-to-one line sorting, Product lists, Quotes, Journal entries, Streamline workflow, Improve efficiency.
    Personalización avanzada, menú arrastrar y soltar, columnas personalizadas, campos de base de datos disponibles, opciones de ordenación, renombrar columnas, búsqueda avanzada, campos de texto, campos de opción, campos de fecha, ordenación de líneas muchos-a-uno, listas de productos, cotizaciones, entradas de diario, mejorar la eficiencia.
    """,
    'category': 'Apps/List',
    'depends': ['base', 'web'],

    'data': [
        'views/assets.xml',
        'security/ir.model.access.csv',
        'views/advanced_dynamic_web.xml',
    ],
    "qweb": ["static/xml/*.xml"],
    'price': 49.00,
    'currency': 'EUR',
    'license': 'OPL-1',
    'images': ['static/description/banner.gif'],
    'auto_install': False,
    'application': True,
    'installable': True,
}
