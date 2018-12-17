Template.configureLoginServiceDialogForWxwork.helpers({
  siteUrl: function () {
    return Meteor.absoluteUrl();
  }
});

Template.configureLoginServiceDialogForWxwork.fields = function () {
  return [
    {property: 'appId', label: 'APP Id'},
    {property: 'secret', label: 'APP Secret'}
  ];
};
